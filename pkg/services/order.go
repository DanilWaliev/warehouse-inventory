package services

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type ProductionOrderService struct {
	orderModel  *mysql.ProductionOrderModel
	recipeModel *mysql.RecipeModel
}

func NewOrderService(orderModel *mysql.ProductionOrderModel, recipeModel *mysql.RecipeModel) *ProductionOrderService {
	return &ProductionOrderService{
		orderModel:  orderModel,
		recipeModel: recipeModel,
	}
}

func (s *ProductionOrderService) ReadAll() ([]*models.ProductionOrder, error) {
	return s.orderModel.SelectAll(s.recipeModel)
}

func (s *ProductionOrderService) ReadByIDs(ids []int) ([]*models.ProductionOrder, error) {
	var orders []*models.ProductionOrder

	for _, id := range ids {
		order, err := s.orderModel.SelectByID(id, s.recipeModel)
		if err != nil {
			return nil, err
		}

		orders = append(orders, order)
	}

	return orders, nil
}

func (s *ProductionOrderService) Create(order *models.ProductionOrder) error {
	for _, item := range order.Items {
		recipe, err := s.recipeModel.SelectByID(item.Recipe.Result.ID)
		if err != nil {
			return err
		}

		item = models.ProductionOrderItem{Recipe: *recipe,
			Quantity: item.Quantity,
		}
	}

	return s.orderModel.Insert(order)
}

func (s *ProductionOrderService) Update(id int) error {
	return s.orderModel.Update(id)
}

func (s *ProductionOrderService) Delete(id int) error {
	return s.orderModel.Delete(id)
}
