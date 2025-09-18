package pages

import (
	"net/http"
	"warehouse-inventory/pkg/handlers"
)

type PageHandler struct {
	renderer handlers.Renderer
	helper   handlers.LogHelper
}

func (h *PageHandler) Root(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		h.helper.NotFound(w)
		return
	}

	// // Авторизация
	// role, err := app.auth(r)
	// if err != nil || role == "" {
	// 	http.Redirect(w, r, "/signin", http.StatusFound)
	// 	return
	// }

	h.renderer.Render(w, "main.page.tmpl", nil)
}
