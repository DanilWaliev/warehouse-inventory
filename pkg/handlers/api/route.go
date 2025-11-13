package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/services"
	"warehouse-inventory/pkg/sqlerr"
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
	var (
		ids        []int
		fromIds    []int
		toIds      []int
		transitIds []int
	)

	// получаем просто Id
	for _, idStr := range r.URL.Query()["id"] {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}
		ids = append(ids, id)
	}

	// получаем fromId
	for _, idStr := range r.URL.Query()["fromId"] {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}
		fromIds = append(fromIds, id)
	}

	// получаем toId
	for _, idStr := range r.URL.Query()["toId"] {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}
		toIds = append(toIds, id)
	}

	// получаем transitId
	for _, idStr := range r.URL.Query()["transitId"] {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			h.Helper.ClientError(w, http.StatusBadRequest)
			return
		}
		transitIds = append(transitIds, id)
	}

	// Валидация параметров
	if (len(ids) > 0 && (len(fromIds) > 0 || len(toIds) > 0 || len(transitIds) > 0)) ||
		(len(fromIds) > 0 && (len(toIds) > 0 || len(transitIds) > 0)) ||
		(len(toIds) > 0 && len(transitIds) > 0) {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	var (
		routes []*models.Route
		err    error
	)

	switch {
	case len(ids) > 0:
		routes, err = h.RouteService.ReadByIDs(ids)
	case len(fromIds) > 0:
		routes, err = h.RouteService.ReadByFromIDs(ids)
	case len(toIds) > 0:
		routes, err = h.RouteService.ReadByToIDs(ids)
	case len(transitIds) > 0:
		routes, err = h.RouteService.ReadByTransitIDs(ids)
	default:
		routes, err = h.RouteService.ReadAll()
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

func (h *RouteHandler) Post(w http.ResponseWriter, r *http.Request) {
	var newRoute struct {
		FromID    int `json:"fromId"`
		ToID      int `json:"toId"`
		TransitID int `json:"transitId"`
		EDH       int `json:"etaHours"`
	}

	err := json.NewDecoder(r.Body).Decode(&newRoute)
	if err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	err = h.RouteService.Create(newRoute.FromID, newRoute.ToID, newRoute.TransitID, newRoute.EDH)
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

	w.WriteHeader(http.StatusCreated)
}

func (h *RouteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.URL.Query().Get("id"))
	if err != nil {
		h.Helper.ClientError(w, http.StatusBadRequest)
		return
	}

	err = h.RouteService.Delete(id)
	if err != nil {
		h.Helper.ServerError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
