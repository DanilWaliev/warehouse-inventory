package main

import (
	"net/http"
)

// Аутентификация пользователя
func (app *application) signIn(w http.ResponseWriter, r *http.Request) {
	// Проверяем метод
	// Если не POST, то грузим пустую страницу аутентификации
	if r.Method != http.MethodPost {
		app.render(w, "auth.page.tmpl", nil)
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

		app.render(w, "auth.page.tmpl", templateData)
		return
	}
}

// Регистрация пользователя
