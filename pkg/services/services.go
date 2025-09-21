package services

import "warehouse-inventory/pkg/models/mysql"

type Services struct {
	UserService      *UserService
	ComponentService *ComponentService
}

func NewServices(models *mysql.MySQLModels) *Services {
	return &Services{
		UserService:      NewUserService(models.UserModel),
		ComponentService: NewComponentService(models.ComponentModel),
	}
}
