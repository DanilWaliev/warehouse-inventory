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

	var (
		users []*models.User
		err   error
	)

	switch {
	case len(ids) > 0:
		users, err = h.UserService.ReadByIDs(ids)
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
