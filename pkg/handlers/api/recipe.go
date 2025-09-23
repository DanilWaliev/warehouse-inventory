package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/services"
	"warehouse-inventory/pkg/sqlerr"
)

type RecipeHandler struct {
	Helper        *handlers.LogHelper
	RecipeService *services.RecipeService
}

func NewRecipeHandler(helper *handlers.LogHelper, recipeService *services.RecipeService) *RecipeHandler {
	return &RecipeHandler{
		Helper:        helper,
		RecipeService: recipeService,
	}
}

func (h *RecipeHandler) Get(w http.ResponseWriter, r *http.Request) {
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
		recipes []*models.Recipe
		err     error
	)

	if len(ids) > 0 {
		recipes, err = h.RecipeService.ReadByIDs(ids)
	} else {
		recipes, err = h.RecipeService.ReadAll()
	}

	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}
	if len(recipes) == 0 {
		h.Helper.NotFound(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(recipes); err != nil {
		h.Helper.ServerError(w, err)
		return
	}
}

func (h *RecipeHandler) Post(w http.ResponseWriter, r *http.Request) {
	// Структура для приёма JSON
	var input struct {
		ResultID int    `json:"resultId"`
		Type     string `json:"type"`
		Items    []struct {
			ComponentID int `json:"componentId"`
			Quantity    int `json:"quantity"`
		} `json:"items"`
	}

	// Декодируем JSON
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	// Проверка минимальных условий
	if input.ResultID == 0 || len(input.Items) == 0 {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	// Маппим в модель без Type (его подставит сервис)
	rp := &models.Recipe{
		Result: models.Component{
			ID: input.ResultID,
		},
	}

	for _, it := range input.Items {
		if it.ComponentID == 0 || it.Quantity <= 0 {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}
		rp.Items = append(rp.Items, models.RecipeItem{
			Ingredient: models.Component{ID: it.ComponentID},
			Quantity:   it.Quantity,
		})
	}

	// Сохраняем в БД
	err := h.RecipeService.Create(rp)
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

func (h *RecipeHandler) Put(w http.ResponseWriter, r *http.Request) {
	var input struct {
		ResultID int `json:"resultId"`
		Items    []struct {
			ComponentID int `json:"componentId"`
			Quantity    int `json:"quantity"`
		} `json:"items"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	if input.ResultID == 0 || len(input.Items) == 0 {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	rp := &models.Recipe{
		Result: models.Component{
			ID: input.ResultID,
		},
	}

	for _, it := range input.Items {
		if it.ComponentID == 0 || it.Quantity <= 0 {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}

		rp.Items = append(rp.Items, models.RecipeItem{
			Ingredient: models.Component{ID: it.ComponentID},
			Quantity:   it.Quantity,
		})
	}

	err := h.RecipeService.Update(rp)
	if err != nil {
		if sqlerr.Is(err, sqlerr.ErrCheckConstraint) {
			h.Helper.ClientError(w, http.StatusBadRequest)
		} else {
			h.Helper.ServerError(w, err)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *RecipeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.URL.Query().Get("id"))

	if id == 0 || err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	err = h.RecipeService.Delete(id)
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
