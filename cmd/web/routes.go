package main

import "net/http"

func (app *application) routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/", app.root)
	mux.HandleFunc("/signin", app.signIn)
	mux.HandleFunc("/signup", app.signUp)

	fileServer := http.FileServer(http.Dir("./ui/static"))
	mux.Handle("/static/", http.StripPrefix("/static", fileServer))

	return mux
}
