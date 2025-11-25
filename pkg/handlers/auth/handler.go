package auth

import (
	"net/http"
	"time"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/hash"
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/services"
)

/* Структура обработчика авторизации и аутнтификации, обработчики страниц входа и регистрации */

type AuthHandler struct {
	JWTkey      []byte
	helper      *handlers.LogHelper
	renderer    *handlers.Renderer
	UserService *services.UserService
}

func NewAuthHandler(JWTkey []byte, helper *handlers.LogHelper, renderer *handlers.Renderer, userService *services.UserService) *AuthHandler {
	return &AuthHandler{
		JWTkey:      JWTkey,
		helper:      helper,
		renderer:    renderer,
		UserService: userService,
	}
}

func (h *AuthHandler) SignIn(w http.ResponseWriter, r *http.Request) {
	// Проверяем метод
	// Если не POST, то грузим пустую страницу аутентификации
	if r.Method != http.MethodPost {
		h.renderer.Render(w, "signin.page.tmpl", nil)
		return
	}

	// Получаем данные с формы
	email := r.FormValue("email")
	password := r.FormValue("password")

	// Ищем пользователя с указанным email
	user, err := h.UserService.GetByEmail(email)
	if err != nil || !hash.CheckPassword(password, user.PasswordHash) {
		// Создаем структуру для отправки сообщения об ошибке и сохранения email
		templateData := struct {
			Message string
			Email   string
		}{
			Message: "Аккаунт не найден или неверный пароль",
			Email:   email,
		}

		h.renderer.Render(w, "signin.page.tmpl", templateData)
		return
	}

	if !user.IsActive {
		// Создаем структуру для отправки сообщения об ошибке и сохранения email
		templateData := struct {
			Message string
			Email   string
		}{
			Message: "Аккаунт не активен",
			Email:   email,
		}

		h.renderer.Render(w, "signin.page.tmpl", templateData)
		return
	}

	// Отправляем куки с токеном
	tokenString, err := h.CreateToken(user.ID, user.Role, user.FullName)
	if err != nil {
		h.helper.ServerError(w, err)
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
func (h *AuthHandler) SignUp(w http.ResponseWriter, r *http.Request) {
	// Проверяем метод
	// Если не POST, то грузим пустую страницу регистрации
	if r.Method != http.MethodPost {
		h.renderer.Render(w, "signup.page.tmpl", nil)
		return
	}

	// Получаем данные с формы
	fullname := r.FormValue("fullname")
	email := r.FormValue("email")
	phone := r.FormValue("phone")
	role := r.FormValue("role")
	password := r.FormValue("password")

	// Проверяем существует ли пользователь
	if exists, err := h.UserService.ExistsByEmail(email); exists {
		templateData := struct {
			Message string
		}{
			Message: "Пользователь с указанным email уже существует",
		}

		h.renderer.Render(w, "signup.page.tmpl", templateData)
		return
	} else if err != nil && err != models.ErrNoRecord {
		h.helper.ServerError(w, err)
		return
	}

	err := h.UserService.AddUser(fullname, phone, email, password, role)

	if err != nil {
		h.helper.ServerError(w, err)
	}

	http.Redirect(w, r, "/signin", http.StatusFound)
	// TODO: сделать завершение регистрации (окно о том, что администратор рассмотрит заявку)
}

func (h *AuthHandler) SignOut(w http.ResponseWriter, r *http.Request) {
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
