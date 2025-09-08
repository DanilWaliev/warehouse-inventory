package hash

import "golang.org/x/crypto/bcrypt"

/* Файл содержит обертки для функций хеширования пароля и сравнения хеша с паролем */

// Возвращает хеш пароля
func HashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	return string(hashed), nil
}

// true, если пароль подходит к хешу;
// false, если нет.
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
