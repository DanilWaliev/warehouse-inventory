package api

import (
	"net/http"
	"strings"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/services"
)

/* Обработчики запросов к API. Обработчики в зависимости от HTTP-метода вызывают методы соответствующих структур */

type APIHandler struct {
	Helper               *handlers.LogHelper
	ComponentHandler     *ComponentHandler
	RecipeHandler        *RecipeHandler
	UserHandler          *UserHandler
	OrderHandler         *OrderHandler
	StorageHandler       *StorageHandler
	DocumentHandler      *DocumentHandler
	RouteHandler         *RouteHandler
	MovementOrderHandler *MovementOrderHandler
}

func NewAPIHandler(helper *handlers.LogHelper, services *services.Services) *APIHandler {
	return &APIHandler{
		Helper:               helper,
		ComponentHandler:     NewComponentHandler(helper, services.ComponentService),
		RecipeHandler:        NewRecipeHandler(helper, services.RecipeService),
		UserHandler:          NewUserHandler(helper, services.UserService),
		OrderHandler:         NewOrderHandler(helper, services.ProductionOrderService),
		StorageHandler:       NewStorageHandler(helper, services.StorageService),
		DocumentHandler:      NewDocumentHandler(helper, services.DocumentService),
		RouteHandler:         NewRouteHandler(helper, services.RouteService),
		MovementOrderHandler: NewMovementOrderHandler(helper, services.MovementOrderService),
	}
}

func (h *APIHandler) Component(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.ComponentHandler.Get(w, r)
	case http.MethodPost:
		h.ComponentHandler.Post(w, r)
	case http.MethodPut:
		h.ComponentHandler.Put(w, r)
	case http.MethodDelete:
		h.ComponentHandler.Delete(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodPost,
			http.MethodGet,
			http.MethodPut,
			http.MethodDelete,
		}, ", "))

		h.Helper.ClientError(w, http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) User(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.UserHandler.Get(w, r)
	case http.MethodPut:
		h.UserHandler.Put(w, r)
	case http.MethodDelete:
		h.UserHandler.Delete(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodGet,
			http.MethodPut,
			http.MethodDelete,
		}, ", "))

		h.Helper.ClientError(w, http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) Recipe(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.RecipeHandler.Get(w, r)
	case http.MethodPost:
		h.RecipeHandler.Post(w, r)
	case http.MethodPut:
		h.RecipeHandler.Put(w, r)
	case http.MethodDelete:
		h.RecipeHandler.Delete(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodPost,
			http.MethodGet,
			http.MethodPut,
			http.MethodDelete,
		}, ", "))

		h.Helper.ClientError(w, http.StatusMethodNotAllowed)
		return
	}
}

func (h *APIHandler) Order(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.OrderHandler.Get(w, r)
	case http.MethodPost:
		h.OrderHandler.Post(w, r)
	case http.MethodPut:
		h.OrderHandler.Put(w, r)
	case http.MethodDelete:
		h.OrderHandler.Delete(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodPost,
			http.MethodGet,
			http.MethodPut,
			http.MethodDelete,
		}, ", "))

		h.Helper.ClientError(w, http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) Storage(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.StorageHandler.Get(w, r)
	case http.MethodPost:
		h.StorageHandler.Post(w, r)
	case http.MethodPut:
		h.StorageHandler.Put(w, r)
	case http.MethodDelete:
		h.StorageHandler.Delete(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodPost,
			http.MethodGet,
			http.MethodPut,
			http.MethodDelete,
		}, ", "))

		h.Helper.ClientError(w, http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) Document(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.DocumentHandler.Get(w, r)
	case http.MethodPost:
		h.DocumentHandler.Post(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodPost,
			http.MethodGet,
		}, ", "))

		h.Helper.ClientError(w, http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) Route(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.RouteHandler.Get(w, r)
	case http.MethodPost:
		h.RouteHandler.Post(w, r)
	case http.MethodDelete:
		h.RouteHandler.Delete(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodGet,
			http.MethodPost,
			http.MethodDelete,
		}, ", "))

		h.Helper.ClientError(w, http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) MovementOrder(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.MovementOrderHandler.Get(w, r)
	case http.MethodPost:
		h.MovementOrderHandler.Post(w, r)
	case http.MethodPut:
		h.MovementOrderHandler.Put(w, r)
	case http.MethodDelete:
		h.MovementOrderHandler.Delete(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
		}, ", "))

		h.Helper.ClientError(w, http.StatusMethodNotAllowed)
	}
}
