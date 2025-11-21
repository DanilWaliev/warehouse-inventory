package services

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type ProductionOrderService struct {
	orderModel    *mysql.ProductionOrderModel
	recipeModel   *mysql.RecipeModel
	documentModel *mysql.DocumentModel
}

func NewOrderService(orderModel *mysql.ProductionOrderModel, recipeModel *mysql.RecipeModel, documentModel *mysql.DocumentModel) *ProductionOrderService {
	return &ProductionOrderService{
		orderModel:    orderModel,
		recipeModel:   recipeModel,
		documentModel: documentModel,
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

// Create создаёт производственный заказ и сразу документ productionCreate,
// который списывает сырьё и фиксирует начало производства.
func (s *ProductionOrderService) Create(order *models.ProductionOrder, createdBy int) error {
	// 1) Подгружаем полные рецепты по Result.ID и записываем обратно в order.Items
	for i, item := range order.Items {
		recipe, err := s.recipeModel.SelectByID(item.Recipe.Result.ID)
		if err != nil {
			return err
		}

		order.Items[i] = models.ProductionOrderItem{
			Recipe:   *recipe,
			Quantity: item.Quantity,
		}
	}

	// 2) Создаём производственный заказ (только план)
	if err := s.orderModel.Insert(order); err != nil {
		return err
	}

	// 3) Создаём документ productionCreate, который:
	//    - посчитает потребность по рецептам,
	//    - спишет сырьё со склада 1,
	//    - создаст документ и его позиции.
	doc := &models.Document{
		Type:              "productionCreate",
		CreatedBy:         createdBy,
		ProductionOrderID: &order.ID,
	}

	if _, err := s.documentModel.InsertProductionCreate(doc); err != nil {
		return err
	}

	return nil
}

func (s *ProductionOrderService) Update(id int, sender int) error {
	doc := models.Document{
		Type:              "productionFinish", // важно: точно как в ENUM
		CreatedBy:         sender,
		ProductionOrderID: &id,
	}

	// создаём документ завершения + движение инвентаря
	if _, err := s.documentModel.InsertProductionFinish(&doc); err != nil {
		return err
	}

	// дополнительно закрываем заказ (ClosedAt) через модель заказа
	return s.orderModel.Update(id)
}

func (s *ProductionOrderService) Delete(id int) error {
	return s.orderModel.Delete(id)
}
