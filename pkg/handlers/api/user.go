package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/models"
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

func (h *UserHandler) Get(w http.ResponseWriter, r *http.Request) {
	// Собираем id-шники (может быть несколько ?id=1&id=2)
	var ids []int
	for _, idStr := range r.URL.Query()["id"] {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}
		ids = append(ids, id)
	}

	q := r.URL.Query()

	// Проверяем, передавался ли вообще параметр status
	statusVals, hasStatus := q["status"]

	// Нельзя одновременно и status, и id
	if hasStatus && len(ids) > 0 {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	var (
		statusStr string
		status    bool
		users     []*models.User
		err       error
	)

	if hasStatus {
		// Мы разрешаем только ровно один status
		if len(statusVals) != 1 {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}

		statusStr = statusVals[0]

		// Запрещаем пустой статус: ?status=
		if statusStr == "" {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}

		// Разрешаем только active / inactive
		if statusStr != "active" && statusStr != "inactive" {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}

		status = (statusStr == "active")
	}

	switch {
	case len(ids) > 0:
		users, err = h.UserService.ReadByIDs(ids)

	case hasStatus:
		users, err = h.UserService.ReadByStatus(status)

	default:
		// status не передан вообще и id нет — отдать всех
		users, err = h.UserService.ReadAll()
	}

	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}
	if len(users) == 0 {
		h.Helper.NotFound(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(users); err != nil {
		h.Helper.ServerError(w, err)
		return
	}
}

func (h *UserHandler) Put(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.URL.Query().Get("id"))
	if err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	statusStr := r.URL.Query().Get("status")
	if (statusStr != "active") && (statusStr != "inactive") {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	fmt.Printf("\nstatusStr: %v, id: %v\n", statusStr, id)

	if statusStr == "active" {
		err = h.UserService.SetActive(id)
	} else {
		err = h.UserService.SetInactive(id)
	}
	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}
