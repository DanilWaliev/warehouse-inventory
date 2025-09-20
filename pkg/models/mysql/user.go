package mysql

import (
	"database/sql"
	"errors"
	"warehouse-inventory/pkg/models"
)

/* Файл содержит модель для работы с таблицей user в базе данных и методы для данной модели */
/* Методы возвращают модель для хранения данных в коде */

type UserModel struct {
	DB *sql.DB
}

func NewUserModel(db *sql.DB) *UserModel {
	return &UserModel{
		DB: db,
	}
}

func (m *UserModel) GetByEmail(email string) (*models.User, error) {
	stmt := `SELECT User_ID, Email, PasswordHash, FullName, Role, Phone, CreatedAt FROM user
	WHERE Email = ?`

	row := m.DB.QueryRow(stmt, email)

	u := &models.User{}

	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.Phone, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		} else {
			return nil, err
		}
	}

	return u, nil
}

func (m *UserModel) ExistsByEmail(email string) (bool, error) {
	var id int

	stmt := `SELECT User_ID FROM user WHERE Email = ?`
	err := m.DB.QueryRow(stmt, email).Scan(&id)

	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return true, nil
}

func (m *UserModel) Insert(fullname, phone, email, passwordHash, role string) error {
	stmt := `INSERT INTO user(Fullname, Phone, Email, Passwordhash, Role)
	VALUES (?, ?, ?, ?, ?)`

	_, err := m.DB.Exec(stmt, fullname, phone, email, passwordHash, role)

	if err != nil {
		return err
	}

	return nil
}
