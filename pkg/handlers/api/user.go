package api

import (
	"encoding/json"
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
	var ids []int
	for _, idStr := range r.URL.Query()["id"] {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}
		ids = append(ids, id)
	}

	statusStr := r.URL.Query().Get("status")

	if statusStr != "" && len(ids) > 0 {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	if statusStr != "active" && statusStr != "inactive" {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	status := false
	if statusStr == "active" {
		status = true
	}

	var (
		users []*models.User
		err   error
	)

	switch {
	case len(ids) > 0:
		users, err = h.UserService.ReadByIDs(ids)
	case statusStr != "":
		users, err = h.UserService.ReadByStatus(status)
	default:
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
