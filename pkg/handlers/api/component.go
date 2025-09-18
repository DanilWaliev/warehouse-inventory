package api

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/services"
)

type componentHandler struct {
	services.ComponentService
}

func (h *componentHandler) GetAll() ([]*models.Component, error) {
	return h.ComponentService.GetAll()
}
