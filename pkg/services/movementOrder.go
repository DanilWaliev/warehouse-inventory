package services

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type MovementOrderService struct {
	movementOrderModel *mysql.MovementOrderModel
	routeModel         *mysql.RouteModel
	componentModel     *mysql.ComponentModel
}

func NewMovementOrderService(movementOrderModel *mysql.MovementOrderModel, routeModel *mysql.RouteModel, componentModel *mysql.ComponentModel) *MovementOrderService {
	return &MovementOrderService{
		movementOrderModel: movementOrderModel,
		routeModel:         routeModel,
		componentModel:     componentModel,
	}
}

func (s *MovementOrderService) ReadByIDs(ids []int) ([]*models.MovementOrder, error) {
	var orders []*models.MovementOrder

	for _, id := range ids {
		order, err := s.movementOrderModel.SelectByID(id)
		if err != nil {
			return nil, err
		}

		routePtr, err := s.routeModel.SelectByID(order.Route.ID)
		if err != nil {
			return nil, err
		}

		order.Route = *routePtr

		orders = append(orders, order)
	}

	return orders, nil
}

func (s *MovementOrderService) ReadAll() ([]*models.MovementOrder, error) {
	orders, err := s.movementOrderModel.SelectAll()
	if err != nil {
		return nil, err
	}

	for _, order := range orders {
		routePtr, err := s.routeModel.SelectByID(order.Route.ID)
		if err != nil {
			return nil, err
		}

		order.Route = *routePtr

		orders = append(orders, order)
	}

	return orders, nil
}

func (s *MovementOrderService) Create(order *models.MovementOrder) error {
	route, err := s.routeModel.SelectByID(order.Route.ID)
	if err != nil {
		return err
	}
	order.Route = *route

	for _, batch := range order.Batches {
		for _, item := range batch.Items {
			component, err := s.componentModel.SelectByID(item.Component.ID)
			if err != nil {
				return err
			}
			item.Component = *component
		}
	}

	return s.movementOrderModel.Insert(order)
}

func (s *MovementOrderService) UpdateBatchStatus(batchId int, orderId int, newStatus string) error {
	switch newStatus {
	case "running":
		// обновляем статус партии
		err := s.movementOrderModel.UpdateBatchStatus(batchId, "running")
		if err != nil {
			return err
		}
		// проверяем статусы всех партий, если все "running" - меняем статус всего заказа
		order, err := s.movementOrderModel.SelectByID(orderId)
		if err != nil {
			return err
		}

		for _, batch := range order.Batches {
			if batch.Status == "created" {
				return nil
			}
		}

		err = s.movementOrderModel.UpdateStatus(orderId, "running")
		if err != nil {
			return err
		}
	case "done":
		// обновляем статус партии
		err := s.movementOrderModel.UpdateBatchStatus(batchId, "done")
		if err != nil {
			return err
		}
		// проверяем статусы всех партий, если все "done" - меняем статус всего заказа
		order, err := s.movementOrderModel.SelectByID(orderId)
		if err != nil {
			return err
		}

		for _, batch := range order.Batches {
			if batch.Status == "created" || batch.Status == "running" {
				return nil
			}
		}

		err = s.movementOrderModel.UpdateStatus(orderId, "done")
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *MovementOrderService) Delete(id int) error {
	return s.movementOrderModel.Delete(id)
}
