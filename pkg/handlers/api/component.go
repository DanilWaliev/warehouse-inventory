package api

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/services"
)

type ComponentHandler struct {
	ComponentService *services.ComponentService
}

func NewComponentHandler(componentServices *services.ComponentService) *ComponentHandler {
	return &ComponentHandler{
		ComponentService: componentServices,
	}
}

func (h *ComponentHandler) GetAll() ([]*models.Component, error) {
	return h.ComponentService.GetAll()
}
