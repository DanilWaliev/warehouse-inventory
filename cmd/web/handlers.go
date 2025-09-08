package main

import (
	"net/http"
	"time"
	"warehouse-inventory/pkg/hash"
)

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
	if err != nil || !hash.CheckPassword(password, user.PasswordHash) {
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
		HttpOnly: true,
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

	// Получаем данные с формы
	fullname := r.FormValue("fullname")
	email := r.FormValue("email")
	phone := r.FormValue("phone")
	role := r.FormValue("role")
	password := r.FormValue("password")

	// Проверяем существует ли пользователь
	if exists, err := app.models.UserModel.ExistsByEmail(email); exists {
		templateData := struct {
			Message string
		}{
			Message: "Пользователь с указанным email уже существует",
		}

		app.render(w, "signup.page.tmpl", templateData)
		return
	} else if err != nil {
		app.serverError(w, err)
	}

	err := app.models.UserModel.InsertUser(fullname, phone, email, password, role)

	if err != nil {
		app.serverError(w, err)
	}

	http.Redirect(w, r, "/signin", http.StatusFound)
	// TODO: сделать завершение регистрации (окно о том, что администратор рассмотрит заявку)
}

func (app *application) signOut(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "jwt",
		Value:    "",
		Path:     "/",
		Expires:  time.Now().Add(-time.Hour),
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Secure:   true,
	})

	http.Redirect(w, r, "/", http.StatusFound)
}

func (app *application) production(w http.ResponseWriter, r *http.Request) {
	app.render(w, "production.page.tmpl", nil) // TODO: Добавить данные для шаблона
}

// func (app *application) createTMC(w http.ResponseWriter, r * http.Request) {
// 	if (r.Method != http.MethodPost {
// 		// Если не POST, то грузим страницу с имеющемися ТМЦ и кнопкой добавления
// 	})
// }
