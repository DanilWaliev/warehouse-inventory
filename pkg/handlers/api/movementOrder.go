package api

import (
	"net/http"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/services"
)

type MovementOrderHandler struct {
	Helper               *handlers.LogHelper
	MovementOrderService *services.MovementOrderService
}

func NewMovementOrderHandler(helper *handlers.LogHelper, movementOrderService *services.MovementOrderService) *MovementOrderHandler {
	return &MovementOrderHandler{
		Helper:               helper,
		MovementOrderService: movementOrderService,
	}
}

func (h *MovementOrderHandler) Get(w http.ResponseWriter, r *http.Request) {

}

func (h *MovementOrderHandler) Post(w http.ResponseWriter, r *http.Request) {

}

func (h *MovementOrderHandler) Put(w http.ResponseWriter, r *http.Request) {

}
