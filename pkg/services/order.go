package services

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type OrderService struct {
	orderModel  *mysql.OrderModel
	recipeModel *mysql.RecipeModel
}

func NewOrderService(orderModel *mysql.OrderModel, recipeModel *mysql.RecipeModel) *OrderService {
	return &OrderService{
		orderModel:  orderModel,
		recipeModel: recipeModel,
	}
}

func (s *OrderService) ReadAll() ([]*models.Order, error) {
	return s.orderModel.SelectAll(s.recipeModel)
}

func (s *OrderService) ReadByIDs(ids []int) ([]*models.Order, error) {
	var orders []*models.Order

	for _, id := range ids {
		order, err := s.orderModel.SelectByID(id, s.recipeModel)
		if err != nil {
			return nil, err
		}

		orders = append(orders, order)
	}

	return orders, nil
}

func (s *OrderService) Create(order *models.Order) error {
	for _, item := range order.Items {
		recipe, err := s.recipeModel.SelectByID(item.Recipe.Result.ID)
		if err != nil {
			return err
		}

		item = models.OrderItem{Recipe: *recipe,
			Quantity: item.Quantity,
		}
	}

	return s.orderModel.Insert(order)
}

func (s *OrderService) Update(id int) error {
	return s.orderModel.Update(id)
}

func (s *OrderService) Delete(id int) error {
	return s.orderModel.Delete(id)
}
