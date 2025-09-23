package services

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type RecipeService struct {
	recipeModel    *mysql.RecipeModel
	componentModel *mysql.ComponentModel
}

func NewRecipeService(recipeModel *mysql.RecipeModel, componentModel *mysql.ComponentModel) *RecipeService {
	return &RecipeService{
		recipeModel:    recipeModel,
		componentModel: componentModel,
	}
}

func (s *RecipeService) ReadAll() ([]*models.Recipe, error) {
	return s.recipeModel.SelectAll()
}

func (s *RecipeService) ReadByIDs(ids []int) ([]*models.Recipe, error) {
	var recipes []*models.Recipe

	for _, id := range ids {
		recipe, err := s.recipeModel.SelectByID(id)
		if err != nil {
			return nil, err
		}

		recipes = append(recipes, recipe)
	}

	return recipes, nil
}

func (s *RecipeService) Create(recipe *models.Recipe) error {
	// Получаем полные данные о компоненте по полученному ID
	resultComponent, err := s.componentModel.SelectByID(recipe.Result.ID)
	if err != nil {
		return err
	}

	// Собираем все данные об ингридиенте
	items := []models.RecipeItem{}
	for _, item := range recipe.Items {
		ingredient, err := s.componentModel.SelectByID(item.Ingredient.ID)
		if err != nil {
			return err
		}

		items = append(items, models.RecipeItem{
			Ingredient: *ingredient,
			Quantity:   item.Quantity,
		})
	}

	return s.recipeModel.Insert(&models.Recipe{
		Result: *resultComponent,
		Items:  items,
	})
}

func (s *RecipeService) Delete(id int) error {
	return s.recipeModel.Delete(id)
}

func (s *RecipeService) Update(recipe *models.Recipe) error {
	// Получаем полные данные о компоненте по полученному ID
	resultComponent, err := s.componentModel.SelectByID(recipe.Result.ID)
	if err != nil {
		return err
	}

	// Собираем все данные об ингридиенте
	items := []models.RecipeItem{}
	for _, item := range recipe.Items {
		ingredient, err := s.componentModel.SelectByID(item.Ingredient.ID)
		if err != nil {
			return err
		}

		items = append(items, models.RecipeItem{
			Ingredient: *ingredient,
			Quantity:   item.Quantity,
		})
	}

	return s.recipeModel.Update(&models.Recipe{
		Result: *resultComponent,
		Items:  items,
	})
}
