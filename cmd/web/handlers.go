package main

import (
	"fmt"
	"net/http"
	"time"
)

func (app *application) root(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		app.notFound(w)
		return
	}

	// Авторизация
	role, err := app.auth(w, r)
	if err != nil || role == "" {
		http.Redirect(w, r, "/signin", http.StatusFound)
		return
	}

	w.Write([]byte(fmt.Sprintf("добро пожаловать, %v", role)))
	// TODO: сделать главную страницу
}

// Аутентификация пользователя
func (app *application) signIn(w http.ResponseWriter, r *http.Request) {
	// Проверяем метод
	// Если не POST, то грузим пустую страницу аутентификации
	if r.Method != http.MethodPost {
		app.render(w, "signin.page.tmpl", nil)
		return
	}

	// Получаем данные с формы
	email := r.FormValue("email")
	password := r.FormValue("password")

	// Ищем пользователя с указанным email
	user, err := app.models.UserModel.GetByEmail(email)
	if err != nil || CheckPassword(password, user.PasswordHash) {
		// Создаем структуру для отправки сообщения об ошибке и сохранения email
		templateData := struct {
			Message string
			Email   string
		}{
			Message: "Аккаунт не найден или неверный пароль",
			Email:   email,
		}

		app.render(w, "signin.page.tmpl", templateData)
		return
	}

	// Отправляем куки с токеном
	tokenString, err := app.createToken(user.Role, user.FullName)
	if err != nil {
		app.serverError(w, err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "jwt",
		Value:    tokenString,
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	})

	// Переадресация на главную страницу
	http.Redirect(w, r, "/", http.StatusFound)
}

// Регистрация пользователя
func (app *application) signUp(w http.ResponseWriter, r *http.Request) {
	// Проверяем метод
	// Если не POST, то грузим пустую страницу регистрации
	if r.Method != http.MethodPost {
		app.render(w, "signup.page.tmpl", nil)
		return
	}

}
