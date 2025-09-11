package sqlerr

// Пакет для определения ошибки при выполнении запроса в БД MySQL

import (
	"errors"

	"github.com/go-sql-driver/mysql"
)

// Константы ошибок
var (
	ErrCheckConstraint = errors.New("check constraint violation")
	ErrDuplicateEntry  = errors.New("duplicate entry")
	ErrForeignKey      = errors.New("foreign key violation")
)

// Is проверяет тип ошибки
func Is(err error, target error) bool {
	if err == nil {
		return false
	}

	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		switch mysqlErr.Number {
		case 3819, 1048: // Check constraint violations
			return target == ErrCheckConstraint
		case 1062: // Duplicate entry
			return target == ErrDuplicateEntry
		case 1452: // Foreign key
			return target == ErrForeignKey
		}
	}

	return errors.Is(err, target)
}
