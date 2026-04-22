-- ============================================================
-- 种子数据：示例餐厅 + 15 条菜单
-- 使用前请先在 auth.users 中创建用户，并替换 owner_id
-- ============================================================

-- 插入示例餐厅（使用占位 owner_id，实际使用时替换）
insert into public.restaurants (id, name, slug, owner_id, address, phone, kitchen_password)
values (
  '00000000-0000-0000-0000-000000000001',
  'Casa Portuguesa',
  'casa-portuguesa',
  '00000000-0000-0000-0000-000000000000',  -- 替换为真实 user id
  'Rua da Alegria 123, Lisboa',
  '+351 21 123 4567',
  '1234'
)
on conflict (slug) do nothing;

-- ============================================================
-- 15 条示例菜单
-- ============================================================
insert into public.menu_items
  (restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, sort_order)
values

-- Entradas（前菜）
(
  '00000000-0000-0000-0000-000000000001',
  'Pão com Manteiga', 'Bread & Butter', '黄油面包',
  'Pão artesanal com manteiga da aldeia',
  'Artisan bread with village butter',
  2.50, 'Entradas', '🍞', 1
),
(
  '00000000-0000-0000-0000-000000000001',
  'Azeitonas Temperadas', 'Seasoned Olives', '调味橄榄',
  'Azeitonas marinadas com alho e ervas aromáticas',
  'Marinated olives with garlic and aromatic herbs',
  4.50, 'Entradas', '🫒', 2
),
(
  '00000000-0000-0000-0000-000000000001',
  'Caldo Verde', 'Green Broth Soup', '绿汤',
  'Sopa tradicional portuguesa com couve e chouriço',
  'Traditional Portuguese soup with kale and chorizo',
  6.50, 'Entradas', '🥣', 3
),
(
  '00000000-0000-0000-0000-000000000001',
  'Pataniscas de Bacalhau', 'Codfish Fritters', '鳕鱼饼',
  'Frituras de bacalhau com salada de feijão frade',
  'Codfish fritters served with black-eyed pea salad',
  9.50, 'Entradas', '🐟', 4
),

-- Pratos（主菜）
(
  '00000000-0000-0000-0000-000000000001',
  'Bacalhau à Brás', 'Codfish à Brás', '碎蛋鳕鱼',
  'Bacalhau desfiado com batata palha e ovos mexidos',
  'Shredded codfish with straw potatoes and scrambled eggs',
  18.50, 'Pratos', '🥚', 1
),
(
  '00000000-0000-0000-0000-000000000001',
  'Frango no Churrasco', 'BBQ Chicken', '烤鸡',
  'Frango grelhado com molho piri-piri e batata frita',
  'Grilled chicken with piri-piri sauce and french fries',
  15.00, 'Pratos', '🍗', 2
),
(
  '00000000-0000-0000-0000-000000000001',
  'Polvo à Lagareiro', 'Octopus Lagareiro', '橄榄油章鱼',
  'Polvo assado com azeite e batata a murro',
  'Roasted octopus with olive oil and crushed potatoes',
  22.00, 'Pratos', '🐙', 3
),
(
  '00000000-0000-0000-0000-000000000001',
  'Bitoque de Vaca', 'Beef Steak', '牛排套餐',
  'Bife de vaca com ovo estrelado, batata frita e arroz',
  'Beef steak with fried egg, french fries and rice',
  16.50, 'Pratos', '🥩', 4
),
(
  '00000000-0000-0000-0000-000000000001',
  'Arroz de Pato', 'Duck Rice', '鸭肉饭',
  'Arroz cremoso de pato com chouriço e laranja',
  'Creamy duck rice with chorizo and orange',
  17.50, 'Pratos', '🦆', 5
),

-- Bebidas（饮料）
(
  '00000000-0000-0000-0000-000000000001',
  'Vinho Tinto da Casa', 'House Red Wine', '招牌红酒',
  'Vinho tinto regional, copo',
  'Regional red wine, by the glass',
  4.00, 'Bebidas', '🍷', 1
),
(
  '00000000-0000-0000-0000-000000000001',
  'Super Bock', 'Super Bock Beer', '超级波克啤酒',
  'Cerveja portuguesa gelada, 33cl',
  'Cold Portuguese beer, 33cl',
  2.50, 'Bebidas', '🍺', 2
),
(
  '00000000-0000-0000-0000-000000000001',
  'Água com Gás', 'Sparkling Water', '气泡水',
  'Água mineral com gás, 50cl',
  'Sparkling mineral water, 50cl',
  1.50, 'Bebidas', '💧', 3
),
(
  '00000000-0000-0000-0000-000000000001',
  'Café Expresso', 'Espresso Coffee', '浓缩咖啡',
  'Café expresso tradicional português',
  'Traditional Portuguese espresso coffee',
  1.00, 'Bebidas', '☕', 4
),

-- Sobremesas（甜点）
(
  '00000000-0000-0000-0000-000000000001',
  'Pastel de Nata', 'Custard Tart', '葡式蛋挞',
  'Pastel de Belém original com canela e açúcar em pó',
  'Original Belém custard tart with cinnamon and powdered sugar',
  2.50, 'Sobremesas', '🥧', 1
),
(
  '00000000-0000-0000-0000-000000000001',
  'Arroz Doce', 'Rice Pudding', '葡式米布丁',
  'Arroz doce cremoso com canela e limão',
  'Creamy rice pudding with cinnamon and lemon',
  5.00, 'Sobremesas', '🍮', 2
);
