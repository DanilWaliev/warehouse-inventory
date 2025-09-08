package main

import (
	"fmt"
	"net/http"
	"time"
	"warehouse-inventory/pkg/hash"

	"github.com/golang-jwt/jwt/v5"
)

/* В данном файле определены вспомогательные функции
для обработчиков запросов к /signout, /signin и /signup и сами эти обработчики */

func (app *application) createToken(role, fullname string) (string, error) {
	// Получаем секретный ключ для подписания
	key := app.JWTkey

	// Карта данных
	claims := jwt.MapClaims{
		"fullname": fullname,
		"role":     role,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
		"iat":      time.Now().Unix(),
	}

	// Создаем токен, подписываем и передаем строку в tokenString
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(key)
}

// Верификацирует токен и возвращает карту с полезной нагрузкой
func (app *application) verifyToken(tokenString string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		return app.JWTkey, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))

	if err != nil {
		return nil, err
	}

	// Получаение карты полезной нагрузки из токена
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("неправильный токен")
}

// Авторизация пользователя. Возвращает роль в виде строки или перенаправляет на регистрацию
func (app *application) auth(r *http.Request) (string, error) {
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
