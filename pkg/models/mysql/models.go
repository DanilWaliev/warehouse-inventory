package mysql

import "database/sql"

/* Файл содержит структуру для сборки всех моделей в одно место */

// Собирает все модели в одну структуру для удобства использования
type MySQLModels struct {
	UserModel            *UserModel
	ComponentModel       *ComponentModel
	RecipeModel          *RecipeModel
	ProductionOrderModel *ProductionOrderModel
	StorageModel         *StorageModel
	DocumentModel        *DocumentModel
}

// Конструктор
func NewMySQLModels(db *sql.DB) *MySQLModels {
	return &MySQLModels{
		UserModel:            NewUserModel(db),
		ComponentModel:       NewComponentModel(db),
		RecipeModel:          NewRecipeModel(db),
		ProductionOrderModel: NewProductionOrderModel(db),
		StorageModel:         NewStorageModel(db),
		DocumentModel:        NewDocumentModel(db),
	}
}
