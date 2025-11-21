package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/handlers/auth"
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/services"
	"warehouse-inventory/pkg/sqlerr"
)

type OrderHandler struct {
	Helper       *handlers.LogHelper
	OrderService *services.ProductionOrderService
}

func NewOrderHandler(helper *handlers.LogHelper, orderService *services.ProductionOrderService) *OrderHandler {
	return &OrderHandler{
		Helper:       helper,
		OrderService: orderService,
	}
}

func (h *OrderHandler) Get(w http.ResponseWriter, r *http.Request) {
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
		orders []*models.ProductionOrder
		err    error
	)

	if len(ids) > 0 {
		orders, err = h.OrderService.ReadByIDs(ids)
	} else {
		orders, err = h.OrderService.ReadAll()
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

func (h *OrderHandler) Post(w http.ResponseWriter, r *http.Request) {
	// Структура для приёма JSON
	var input struct {
		Items []struct {
			RecipeComponentID int `json:"recipeId"`
			Quantity          int `json:"quantity"`
		} `json:"items"`
	}

	// Декодируем JSON
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	// Проверка минимальных условий
	if len(input.Items) == 0 {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	// Маппим в модель
	o := &models.ProductionOrder{}

	for _, it := range input.Items {
		if it.RecipeComponentID == 0 || it.Quantity <= 0 {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}

		o.Items = append(o.Items, models.ProductionOrderItem{
			Recipe: models.Recipe{Result: models.Component{
				ID: it.RecipeComponentID,
			}},
			Quantity: it.Quantity,
		})
	}

	// Получаем данные об отправителе
	senderUser := r.Context().Value(auth.UserContextKey).(*auth.AuthorizedUser)

	// Сохраняем в БД
	err := h.OrderService.Create(o, senderUser.ID)
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

	// Успех: 201 Created
	w.WriteHeader(http.StatusCreated)
}

func (h *OrderHandler) Put(w http.ResponseWriter, r *http.Request) {
	// Структура для приёма JSON
	var input struct {
		ID int `json:"id"`
	}

	// Декодируем JSON
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	// Получаем данные об отправителе
	senderUser := r.Context().Value(auth.UserContextKey).(*auth.AuthorizedUser)

	// Проверка минимальных условий
	if input.ID == 0 {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	// Сохраняем в БД
	err := h.OrderService.Update(input.ID, senderUser.ID)
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

	// Успех: 201 Created
	w.WriteHeader(http.StatusCreated)
}

func (h *OrderHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.URL.Query().Get("id"))

	if id == 0 || err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	err = h.OrderService.Delete(id)
	if err != nil {
		if sqlerr.Is(err, sql.ErrNoRows) {
			h.Helper.NotFound(w)
		} else {
			h.Helper.ServerError(w, err)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
