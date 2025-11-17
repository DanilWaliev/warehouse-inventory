package services

import "warehouse-inventory/pkg/models/mysql"

type Services struct {
	UserService            *UserService
	ComponentService       *ComponentService
	RecipeService          *RecipeService
	ProductionOrderService *ProductionOrderService
	StorageService         *StorageService
	DocumentService        *DocumentService
	RouteService           *RouteService
	MovementOrderService   *MovementOrderService
}

func NewServices(models *mysql.MySQLModels) *Services {
	return &Services{
		UserService:            NewUserService(models.UserModel),
		ComponentService:       NewComponentService(models.ComponentModel),
		RecipeService:          NewRecipeService(models.RecipeModel, models.ComponentModel),
		ProductionOrderService: NewOrderService(models.ProductionOrderModel, models.RecipeModel),
		StorageService:         NewStorageService(models.StorageModel),
		DocumentService:        NewDocumentService(models.DocumentModel),
		RouteService:           NewRouteService(models.RouteModel, models.StorageModel),
		MovementOrderService:   NewMovementOrderService(models.MovementOrderModel, models.RouteModel, models.ComponentModel, models.StorageModel),
	}
}
