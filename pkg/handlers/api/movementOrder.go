package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/handlers/auth"
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/services"
	"warehouse-inventory/pkg/sqlerr"
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
	// GET по id
	var ids []int
	for _, idStr := range r.URL.Query()["id"] {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}
		ids = append(ids, id)
	}

	var (
		orders []*models.MovementOrder
		err    error
	)

	if len(ids) > 0 {
		orders, err = h.MovementOrderService.ReadByIDs(ids)
	} else {
		orders, err = h.MovementOrderService.ReadAll()
	}

	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}
	if len(orders) == 0 {
		h.Helper.NotFound(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(orders); err != nil {
		h.Helper.ServerError(w, err)
		return
	}
}

func (h *MovementOrderHandler) Post(w http.ResponseWriter, r *http.Request) {
	var input struct {
		FromId    int    `json:"fromId"`
		ToId      int    `json:"toId"`
		TransitId int    `json:"transitId"`
		RouteId   int    `json:"routeId"`
		CreatedBy int    `json:"createdBy"`
		Notes     string `json:"notes"`
		Batches   []struct {
			Items []struct {
				ComponentId int `json:"componentId"`
				Quantity    int `json:"quantity"`
			}
		}
	}

	// Декодируем JSON
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	// Проверка минимальных условий
	if input.FromId == 0 || input.ToId == 0 || input.TransitId == 0 || len(input.Batches) == 0 || len(input.Batches[0].Items) == 0 {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	// Получаем данные об отправителе
	senderUser := r.Context().Value(auth.UserContextKey).(*auth.AuthorizedUser)

	// Маппинг в модели
	mo := &models.MovementOrder{
		Route: models.Route{
			ID: input.RouteId,
		},
		Status:    "created",
		CreatedBy: senderUser.ID,
		Notes:     input.Notes,
	}

	for batchNo, batch := range input.Batches {
		mo.Batches = append(mo.Batches, models.Batch{})
		for _, item := range batch.Items {
			mo.Batches[batchNo].Items = append(mo.Batches[batchNo].Items, models.BatchItem{
				Component: models.Component{
					ID: item.ComponentId,
				},
				Quantity: item.Quantity,
			})
		}
	}

	// Передаем в сервисы
	err := h.MovementOrderService.Create(mo)
	if err != nil {
		if sqlerr.Is(err, sqlerr.ErrDuplicateEntry) {
			h.Helper.ClientError(w, http.StatusConflict)
		} else if sqlerr.Is(err, sqlerr.ErrCheckConstraint) {
			h.Helper.ClientError(w, http.StatusBadRequest)
		} else {
			h.Helper.ServerError(w, err)
		}
		return
	}
}

func (h *MovementOrderHandler) Put(w http.ResponseWriter, r *http.Request) {

}

func (h *MovementOrderHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.URL.Query().Get("id"))
	if err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	err = h.MovementOrderService.Delete(id)
	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
