package pages

import (
	"net/http"
	"warehouse-inventory/pkg/handlers"
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

	h.Renderer.Render(w, "main.page.tmpl", nil)
}

func (h *PageHandler) Production(w http.ResponseWriter, r *http.Request) {
	h.Renderer.Render(w, "production.page.tmpl", nil)
}

func (h *PageHandler) Movement(w http.ResponseWriter, r *http.Request) {
	h.Renderer.Render(w, "movement.page.tmpl", nil)
}
