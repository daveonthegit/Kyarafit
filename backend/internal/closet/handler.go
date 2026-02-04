package closet

import "github.com/gofiber/fiber/v2"

// MockItems returns hardcoded closet items matching the prototype.
var MockItems = []Item{
	{
		ID:       "001",
		Name:     "Arlecchino Wig",
		Category: "Wigs",
		ImageURL: "https://lh3.googleusercontent.com/aida-public/AB6AXuBu_SZd735qYIoLuhK64k-v3rkLy747i8ue_eH0N3xYPJbFfLIbKTVm3H-NcZKqndHcu7oc5R6oewk0qzI59bly1EUxBH8v_Rksago6lmZEEUMphUaNGZWEVkABr3W0VuzaghrdMUk4d_908-swoxIEwGiMwYZ2vS4ll8I4ag19hB22sskICQ_WverIln2OaHA-UVny57iBW11GSZL7UBfu6pwj192s2Eef0qAaLpXYi0LribO8DOh31AUeQf2hy-No5kYha4q4BEpE",
		Tags:     []string{"wig", "character"},
	},
	{
		ID:       "002",
		Name:     "Master Sword",
		Category: "Props",
		ImageURL: "https://lh3.googleusercontent.com/aida-public/AB6AXuANB3dhJnBdXJaL_UnZMR1yklmotO8qguSIjtgHVdJGshhrjA0Wb9tNJnobCISZ_YmdNp2WnswxnsaTVqyaITjrDuxUSNR26xPv8-NkKwEV7Pmu9sD5Ybq_9oia63qgI8oWfU8TFRCQuvbmabe8RtAwIZdNzZ0ZyEC1sefwCy1t2IOwujj6tqmJPsxLbm9fo4Z4KY3VFUeuK88hUDdq7cCXsLs1YgsJnluz1wdKU7eD_qoRbaqKRUa7Lh6rV9HIViA5YIED8nN2akxW",
		Tags:     []string{"prop", "weapon"},
	},
	{
		ID:       "003",
		Name:     "Eula Boots",
		Category: "Shoes",
		ImageURL: "https://lh3.googleusercontent.com/aida-public/AB6AXuC0KNVxrzmKEfU8I1GM36PMulIKrN3kEY-QtwCx9lLVg8Bavfx0uEW1ESSwDj545cDbYL3qYxLng9mEyzymtyn7QB2C-S6pYNwgMA_hYGl3sp8cbVfnloMdlCrNs1jpdO_GRJiWH_6SutiSdfT8YBADIagzAsSCCMKAIJB1TPNBINU-Pcudo4Zu88WWEvh-cP6wbVKhnKjROAttqtSuVx313sN5Oy7O_UBHg9j5lNjZQeGT8wzpDmVcxW0FKAJ1LekPZhIGnlqPXW2Y",
		Tags:     []string{"footwear", "armor"},
	},
}

// List returns the mock closet items.
func List(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"items": MockItems})
}
