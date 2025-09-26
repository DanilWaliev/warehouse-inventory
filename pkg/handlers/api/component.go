package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/services"
	"warehouse-inventory/pkg/sqlerr"
)

type ComponentHandler struct {
	Helper           *handlers.LogHelper
	ComponentService *services.ComponentService
}

func NewComponentHandler(helper *handlers.LogHelper, componentServices *services.ComponentService) *ComponentHandler {
	return &ComponentHandler{
		Helper:           helper,
		ComponentService: componentServices,
	}
}

/* Возвращает клиенту JSON массив компонентов, удовлетворяющих условиям */
func (h *ComponentHandler) Get(w http.ResponseWriter, r *http.Request) {
	types := r.URL.Query()["type"]

	var ids []int
	for _, idStr := range r.URL.Query()["id"] {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}
		ids = append(ids, id)
	}

	// Нельзя одновременно фильтровать и по типу, и по id
	if len(types) > 0 && len(ids) > 0 {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	var (
		components []*models.Component
		err        error
	)

	switch {
	case len(types) > 0:
		components, err = h.ComponentService.ReadByTypes(types)
	case len(ids) > 0:
		components, err = h.ComponentService.ReadByIDs(ids)
	default:
		components, err = h.ComponentService.ReadAll()
	}

	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}
	if len(components) == 0 {
		h.Helper.NotFound(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(components); err != nil {
		h.Helper.ServerError(w, err)
		return
	}
}

/* Принимает JSON с данными для нового компонента */
func (h *ComponentHandler) Post(w http.ResponseWriter, r *http.Request) {
	// Структура для получения данных из запроса (используются структурные теги)
	var newTMC struct {
		Name    string  `json:"name"`
		Weight  float64 `json:"weight"`
		TMCtype string  `json:"type"`
		Note    string  `json:"note"`
	}

	// Декодируем полученный JSON в созданную структуру
	err := json.NewDecoder(r.Body).Decode(&newTMC)
	if err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	// Вставляем данные в таблицу
	err = h.ComponentService.Create(newTMC.Name, newTMC.Weight, newTMC.TMCtype, newTMC.Note)
	if err != nil {
		if sqlerr.Is(err, sqlerr.ErrDuplicateEntry) {
			h.Helper.ClientError(w, http.StatusConflict)
		} else if sqlerr.Is(err, sqlerr.ErrCheckConstraint) {
			h.Helper.ClientError(w, http.StatusBadRequest)
		} else {
			h.Helper.ServerError(w, err)
		}
	}

	w.WriteHeader(http.StatusCreated)
}

// Принимает JSON данные для обновления компонента
func (h *ComponentHandler) Put(w http.ResponseWriter, r *http.Request) {
	// Структура для получения данных из запроса (используются структурные теги)
	var newTMC struct {
		ID      int     `json:"id"`
		Name    string  `json:"name"`
		Weight  float64 `json:"weight"`
		TMCtype string  `json:"type"`
		Note    string  `json:"note"`
	}

	// Декодируем полученный JSON в созданную структуру
	err := json.NewDecoder(r.Body).Decode(&newTMC)
	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}

	// Обновляем данные в таблице
	err = h.ComponentService.Update(newTMC.ID, newTMC.Name, newTMC.Weight, newTMC.TMCtype, newTMC.Note)
	if err != nil {
		if sqlerr.Is(err, sqlerr.ErrDuplicateEntry) {
			h.Helper.ClientError(w, http.StatusConflict)
		} else if sqlerr.Is(err, sqlerr.ErrCheckConstraint) {
			h.Helper.ClientError(w, http.StatusBadRequest)
		} else {
			h.Helper.ServerError(w, err)
			fmt.Printf("%+v", err)
		}
	}

	w.WriteHeader(http.StatusOK)
}

// Принимает в параметре URL Id компонента, который надо удалить
func (h *ComponentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.URL.Query().Get("id"))
	if err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	err = h.ComponentService.Delete(id)
	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
