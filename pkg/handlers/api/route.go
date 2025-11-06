package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/services"
)

type RouteHandler struct {
	Helper       *handlers.LogHelper
	RouteService *services.RouteService
}

func NewRouteHandler(helper *handlers.LogHelper, routeService *services.RouteService) *RouteHandler {
	return &RouteHandler{
		Helper:       helper,
		RouteService: routeService,
	}
}

func (h *RouteHandler) Get(w http.ResponseWriter, r *http.Request) {
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
		routes []*models.Route
		err    error
	)

	switch {
	case len(ids) > 0:
		// TODO: создать слой сервисов
	default:
		//
	}

	if err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	if len(routes) == 0 {
		h.Helper.NotFound(w)
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(routes); err != nil {
		h.Helper.ServerError(w, err)
		return
	}
}
