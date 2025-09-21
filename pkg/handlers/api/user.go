package api

import (
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/services"
)

type UserHandler struct {
	Helper      *handlers.LogHelper
	UserService *services.UserService
}

func NewUserHandler(helper *handlers.LogHelper, userService *services.UserService) *UserHandler {
	return &UserHandler{
		Helper:      helper,
		UserService: userService,
	}
}
