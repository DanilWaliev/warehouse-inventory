package main

import (
	"fmt"
	"net/http"
	"runtime/debug"
)

// Авторизация пользователя. Возвращает роль в виде строки или перенаправляет на регистрацию
func (app *application) auth(w http.ResponseWriter, r *http.Request) (string, error) {
	// Проверяем есть ли куки в HTTP запросе
	cookie, err := r.Cookie("jwt")
	if err != nil {
		return "", err
	}

	// Верификация токена и переадрессация на вход если произошла ошибка
	claims, err := app.verifyToken(cookie.Value)
	if err != nil {
		return "", err
	}

	return claims["role"].(string), nil
}

// Записывает в errorLog сообщение об ошибке и отправляет ошибку - Internal server error
func (app *application) serverError(w http.ResponseWriter, err error) {
	trace := fmt.Sprintf("%s\n%s", err.Error(), debug.Stack())
	app.errorLog.Output(2, trace)

	http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
}

// Отправляет пользователю определенный код состояния и описание ошибки
func (app *application) clientError(w http.ResponseWriter, status int) {
	http.Error(w, http.StatusText(status), status)
}

// Отправляет клиенту статус Not Found
func (app *application) notFound(w http.ResponseWriter) {
	app.clientError(w, http.StatusNotFound)
}

// Отправляет клиенту шаблон указанной страницы
func (app *application) render(w http.ResponseWriter, name string, templateData any) {
	// Получаем шаблон по переданному имени страницы
	ts, ok := app.templateCache[name]
	if !ok {
		app.serverError(w, fmt.Errorf("шаблон %s не существует", name))
		return
	}

	// Рендер шаблона
	err := ts.Execute(w, templateData)
	if err != nil {
		app.serverError(w, err)
		return
	}
}
