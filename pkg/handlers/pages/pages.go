package pages

import (
	"net/http"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/handlers/auth"
)

type PageHandler struct {
	Renderer *handlers.Renderer
	Helper   *handlers.LogHelper
}

func NewPageHandler(renderer *handlers.Renderer, helper *handlers.LogHelper) *PageHandler {
	return &PageHandler{
		Renderer: renderer,
		Helper:   helper,
	}
}

func (h *PageHandler) Root(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		h.Helper.NotFound(w)
		return
	}

	// Получаем данные об отправителе
	senderUser := r.Context().Value(auth.UserContextKey).(*auth.AuthorizedUser)

	switch senderUser.Role {
	case "admin":
		h.Users(w, r)
	case "logistics":
		h.Movement(w, r)
	case "prod_manager":
		h.Production(w, r)
	case "storekeeper":
		h.Movement(w, r)
	default:
		h.Helper.NotFound(w)
		return
	}
}

func (h *PageHandler) RenderWithHeader(tmplName string, w http.ResponseWriter, r *http.Request) {
	// Получаем данные об отправителе
	senderUser := r.Context().Value(auth.UserContextKey).(*auth.AuthorizedUser)

	switch senderUser.Role {
	case "admin":
		senderUser.Role = "Администратор"
	case "logistics":
		senderUser.Role = "Логист"
	case "prod_manager":
		senderUser.Role = "Менеджер по производству"
	case "storekeeper":
		senderUser.Role = "Кладовщик"
	default:
		senderUser.Role = "Неизвестная роль"
	}

	templateData := struct {
		CurrentUser struct {
			FullName string
			Role     string
		}
	}{
		CurrentUser: struct {
			FullName string
			Role     string
		}{
			FullName: senderUser.FullName,
			Role:     senderUser.Role,
		},
	}

	h.Renderer.Render(w, tmplName, templateData)
}

func (h *PageHandler) Production(w http.ResponseWriter, r *http.Request) {
	h.RenderWithHeader("production.page.tmpl", w, r)
}

func (h *PageHandler) Movement(w http.ResponseWriter, r *http.Request) {
	h.RenderWithHeader("movement.page.tmpl", w, r)
}

func (h *PageHandler) Inventory(w http.ResponseWriter, r *http.Request) {
	h.RenderWithHeader("inventory.page.tmpl", w, r)
}

func (h *PageHandler) Users(w http.ResponseWriter, r *http.Request) {
	h.RenderWithHeader("users.page.tmpl", w, r)
}
