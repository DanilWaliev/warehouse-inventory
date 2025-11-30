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
	stmt := `SELECT User_ID, Email, PasswordHash, FullName, Role, Phone, CreatedAt, IsActive FROM user
	WHERE Email = ?`

	row := m.DB.QueryRow(stmt, email)

	u := &models.User{}

	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.Phone, &u.CreatedAt, &u.IsActive)
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

func (m *UserModel) SelectByID(id int) (*models.User, error) {
	stmt := `SELECT User_ID, Email, PasswordHash, FullName, Role, Phone, CreatedAt, IsActive FROM user
	where User_ID = ?`

	row := m.DB.QueryRow(stmt, id)
	u := &models.User{}

	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.Phone, &u.CreatedAt, &u.IsActive)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		} else {
			return nil, err
		}
	}

	return u, nil
}

func (m *UserModel) SelectByStatus(active bool) ([]*models.User, error) {
	stmt := `SELECT User_ID, Email, PasswordHash, FullName, Role, Phone, CreatedAt, IsActive FROM user
	WHERE IsActive = ?`

	isActiveFlag := 0
	if active {
		isActiveFlag = 1
	}

	rows, err := m.DB.Query(stmt, isActiveFlag)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var users []*models.User

	for rows.Next() {
		u := &models.User{}

		err := rows.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.Phone, &u.CreatedAt, &u.IsActive)

		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, models.ErrNoRecord
			} else {
				return nil, err
			}
		}

		users = append(users, u)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

func (m *UserModel) SelectAll() ([]*models.User, error) {
	stmt := `SELECT * From user`

	rows, err := m.DB.Query(stmt)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var users []*models.User

	for rows.Next() {
		u := &models.User{}

		err := rows.Scan(&u.ID, &u.PasswordHash, &u.FullName, &u.Role, &u.Email, &u.Phone, &u.CreatedAt, &u.IsActive)

		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, models.ErrNoRecord
			} else {
				return nil, err
			}
		}

		users = append(users, u)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

func (m *UserModel) SetActive(id int) error {
	stmt := `UPDATE user SET IsActive = 1 WHERE User_ID = ?`

	_, err := m.DB.Exec(stmt, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.ErrNoRecord
		} else {
			return err
		}
	}

	return nil
}

func (m *UserModel) SetInactive(id int) error {
	stmt := `UPDATE user SET IsActive = 0 WHERE User_ID = ?`

	_, err := m.DB.Exec(stmt, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.ErrNoRecord
		} else {
			return err
		}
	}

	return nil
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

func (m *UserModel) Delete(id int) error {
	stmt := `DELETE FROM user
	WHERE User_ID = ?`

	_, err := m.DB.Exec(stmt, id)
	if err != nil {
		return err
	}

	return nil
}
