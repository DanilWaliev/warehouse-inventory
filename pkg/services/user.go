package services

import (
	"database/sql"
	"errors"
	"warehouse-inventory/pkg/hash"
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type UserService struct {
	userModel *mysql.UserModel
}

func NewUserService(userModel *mysql.UserModel) *UserService {
	return &UserService{
		userModel: userModel,
	}
}

func (s *UserService) GetByEmail(email string) (*models.User, error) {
	return s.userModel.GetByEmail(email)
}

func (s *UserService) ExistsByEmail(email string) (bool, error) {
	_, err := s.GetByEmail(email)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *UserService) AddUser(fullname, phone, email, password, role string) error {
	passwordHash, err := hash.HashPassword(password)
	if err != nil {
		return err
	}

	s.userModel.Insert(fullname, phone, email, passwordHash, role)
	return nil
}

func (s *UserService) SetActive(id int) error {
	return s.userModel.SetActive(id)
}

func (s *UserService) SetInactive(id int) error {
	return s.userModel.SetInactive(id)
}

func (s *UserService) ReadByIDs(ids []int) ([]*models.User, error) {
	var users []*models.User

	for _, id := range ids {
		user, err := s.userModel.SelectByID(id)
		if err != nil {
			return nil, err
		}

		users = append(users, user)
	}

	return users, nil
}

func (s *UserService) ReadAll() ([]*models.User, error) {
	return s.userModel.SelectAll()
}
