package services

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type MovementOrderService struct {
	movementOrderModel *mysql.MovementOrderModel
	routeModel         *mysql.RouteModel
	componentModel     *mysql.ComponentModel
	storageModel       *mysql.StorageModel
	documentModel      *mysql.DocumentModel
}

func NewMovementOrderService(movementOrderModel *mysql.MovementOrderModel, routeModel *mysql.RouteModel, componentModel *mysql.ComponentModel, storageModel *mysql.StorageModel, documentModel *mysql.DocumentModel) *MovementOrderService {
	return &MovementOrderService{
		movementOrderModel: movementOrderModel,
		routeModel:         routeModel,
		componentModel:     componentModel,
		storageModel:       storageModel,
		documentModel:      documentModel,
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
		routePtr, err = selectStoragesForRoute(routePtr, s.storageModel)
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

func (s *MovementOrderService) UpdateBatchStatus(batchId int, orderId int, newStatus string, createdBy int) error {
	switch newStatus {
	case "running":
		// создаем документ отправки
		mo, err := s.movementOrderModel.SelectByID(orderId)
		if err != nil {
			return err
		}
		route, err := s.routeModel.SelectByID(mo.Route.ID)
		if err != nil {
			return err
		}
		mo.Route = *route

		doc := &models.Document{
			Type:            "send",
			MovementOrderID: &mo.ID,
			StorageID:       &mo.Route.From.ID,
			CreatedBy:       createdBy,
		}

		// обновляем статус партии
		_, err = s.documentModel.InsertMovementSend(doc, batchId)
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
		// создаем документ получки
		mo, err := s.movementOrderModel.SelectByID(orderId)
		if err != nil {
			return err
		}
		doc := &models.Document{
			Type:            "receive",
			MovementOrderID: &mo.ID,
			StorageID:       &mo.Route.To.ID,
			CreatedBy:       createdBy,
		}

		// обновляем статус партии
		_, err = s.documentModel.InsertMovementReceive(doc, batchId)
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

func selectStoragesForRoute(route *models.Route, s *mysql.StorageModel) (*models.Route, error) {
	storagePtr, err := s.SelectWithoutInventoryByID(route.From.ID)
	if err != nil {
		return nil, err
	}
	route.From = *storagePtr

	storagePtr, err = s.SelectWithoutInventoryByID(route.To.ID)
	if err != nil {
		return nil, err
	}
	route.To = *storagePtr

	storagePtr, err = s.SelectWithoutInventoryByID(route.Transit.ID)
	if err != nil {
		return nil, err
	}
	route.Transit = *storagePtr

	return route, nil
}
