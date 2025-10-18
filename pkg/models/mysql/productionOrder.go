package mysql

import (
	"database/sql"
	"errors"
	"warehouse-inventory/pkg/models"
)

type ProductionOrderModel struct {
	DB *sql.DB
}

func NewProductionOrderModel(db *sql.DB) *ProductionOrderModel {
	return &ProductionOrderModel{
		DB: db,
	}
}

// Получить производственный заказ по ID
func (m *ProductionOrderModel) SelectByID(id int, rm *RecipeModel) (*models.ProductionOrder, error) {
	stmt := `SELECT ProductionOrder_ID, CreatedAt, ClosedAt
	         FROM productionorder
	         WHERE ProductionOrder_ID = ? AND ProductionSite_StorageSite_ID = 1`

	row := m.DB.QueryRow(stmt, id)

	o := &models.ProductionOrder{}
	var closedAt sql.NullTime

	err := row.Scan(&o.ID, &o.CreatedAt, &closedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		}
		return nil, err
	}
	if closedAt.Valid {
		o.ClosedAt = &closedAt.Time
	}

	// подгружаем позиции заказа
	stmt = `SELECT Recipe_Component_ID, Quantity 
	        FROM productionorderitem 
	        WHERE ProductionOrder_ID = ?`

	rows, err := m.DB.Query(stmt, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var recipeID, qty int
		if err := rows.Scan(&recipeID, &qty); err != nil {
			return nil, err
		}

		recipe, err := rm.SelectByID(recipeID)
		if err != nil {
			return nil, err
		}

		o.Items = append(o.Items, models.ProductionOrderItem{
			Recipe:   *recipe,
			Quantity: qty,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return o, nil
}

// Получить все производственные заказы
func (m *ProductionOrderModel) SelectAll(rm *RecipeModel) ([]*models.ProductionOrder, error) {
	stmt := `SELECT ProductionOrder_ID, CreatedAt, ClosedAt
	         FROM productionorder
	         WHERE ProductionSite_StorageSite_ID = 1
	         ORDER BY CreatedAt DESC`

	rows, err := m.DB.Query(stmt)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var productionOrders []*models.ProductionOrder

	for rows.Next() {
		o := &models.ProductionOrder{}
		var closedAt sql.NullTime

		if err := rows.Scan(&o.ID, &o.CreatedAt, &closedAt); err != nil {
			return nil, err
		}
		if closedAt.Valid {
			o.ClosedAt = &closedAt.Time
		}

		// подгружаем позиции для каждого заказа
		itemsStmt := `SELECT Recipe_Component_ID, Quantity 
		              FROM productionorderitem 
		              WHERE ProductionOrder_ID = ?`

		itemRows, err := m.DB.Query(itemsStmt, o.ID)
		if err != nil {
			return nil, err
		}

		for itemRows.Next() {
			var recipeID, qty int
			if err := itemRows.Scan(&recipeID, &qty); err != nil {
				itemRows.Close()
				return nil, err
			}

			recipe, err := rm.SelectByID(recipeID)
			if err != nil {
				itemRows.Close()
				return nil, err
			}

			o.Items = append(o.Items, models.ProductionOrderItem{
				Recipe:   *recipe,
				Quantity: qty,
			})
		}
		itemRows.Close()

		productionOrders = append(productionOrders, o)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return productionOrders, nil
}

func (m *ProductionOrderModel) Insert(order *models.ProductionOrder) error {
	// начинаем транзакцию
	tx, err := m.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// вставляем заказ
	stmt := `INSERT INTO productionorder (ProductionSite_StorageSite_ID) VALUES (1)`
	res, err := tx.Exec(stmt)
	if err != nil {
		return err
	}

	orderID, err := res.LastInsertId()
	if err != nil {
		return err
	}
	order.ID = int(orderID)

	// вставляем позиции заказа
	stmt = `INSERT INTO productionorderitem (ProductionOrder_ID, Recipe_Component_ID, Quantity)
	        VALUES (?, ?, ?)`
	for _, item := range order.Items {
		_, err = tx.Exec(stmt, order.ID, item.Recipe.Result.ID, item.Quantity)
		if err != nil {
			return err
		}
	}

	// коммитим
	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (m *ProductionOrderModel) Delete(id int) error {
	stmt := `DELETE FROM productionorder WHERE ProductionOrder_ID = ? AND ProductionSite_StorageSite_ID = 1`
	_, err := m.DB.Exec(stmt, id)
	return err
}

// Обновление заказа (менять список нельзя, только дату закрытия)
func (m *ProductionOrderModel) Update(id int) error {
	stmt := `UPDATE productionorder 
	         SET ClosedAt = CURRENT_TIMESTAMP
	         WHERE ProductionOrder_ID = ? AND ProductionSite_StorageSite_ID = 1`

	_, err := m.DB.Exec(stmt, id)
	return err
}
