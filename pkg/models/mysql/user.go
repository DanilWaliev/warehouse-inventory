package mysql

import (
	"database/sql"
	"errors"
	"warehouse-inventory/pkg/models"
)

type UserModel struct {
	DB *sql.DB
}

func (m *UserModel) GetByEmail(email string) (*models.User, error) {
	stmt := `SELECT User_ID, Email, PasswordHash, FullName, Role, Phone, CreatedAt FROM User
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
