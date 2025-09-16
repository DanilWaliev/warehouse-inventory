package main

import (
	"net/http"
)

/* Файл содержит обработчики запросов к страницам веб-приложения */
func (app *application) root(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		app.notFound(w)
		return
	}

	// Авторизация
	role, err := app.auth(r)
	if err != nil || role == "" {
		http.Redirect(w, r, "/signin", http.StatusFound)
		return
	}

	app.render(w, "main.page.tmpl", nil)
}

func (app *application) production(w http.ResponseWriter, r *http.Request) {
	app.render(w, "production.page.tmpl", nil)
}
