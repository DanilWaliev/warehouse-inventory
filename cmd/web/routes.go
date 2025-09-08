package main

import "net/http"

func (app *application) routes() *http.ServeMux {
	mux := http.NewServeMux()
	// Запросы к страницам
	mux.HandleFunc("/", app.root)
	mux.HandleFunc("/signin", app.signIn)
	mux.HandleFunc("/signup", app.signUp)
	mux.HandleFunc("/signout", app.signOut)
	mux.HandleFunc("/production", app.production)

	// Запросы к API
	mux.HandleFunc("/api/tmc/create", app.createTMC)
	mux.HandleFunc("/api/tmc/delete", app.deleteTMC)
	mux.HandleFunc("/api/tmc/edit", app.editTMC)

	fileServer := http.FileServer(http.Dir("./ui/static"))
	mux.Handle("/static/", http.StripPrefix("/static", fileServer))

	return mux
}
