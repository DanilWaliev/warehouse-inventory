package services

import "warehouse-inventory/pkg/models/mysql"

type Services struct {
	UserService      *UserService
	ComponentService *ComponentService
	RecipeService    *RecipeService
	OrderService     *OrderService
}

func NewServices(models *mysql.MySQLModels) *Services {
	return &Services{
		UserService:      NewUserService(models.UserModel),
		ComponentService: NewComponentService(models.ComponentModel),
		RecipeService:    NewRecipeService(models.RecipeModel, models.ComponentModel),
		OrderService:     NewOrderService(models.OrderModel, models.RecipeModel),
	}
}
