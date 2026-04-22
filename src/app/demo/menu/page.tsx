import { MenuPage } from '@/components/menu/MenuPage';
import type { MenuItem } from '@/types';

const DEMO_RESTAURANT = {
  id: 'demo',
  name: 'Casa Portuguesa',
  slug: 'demo',
  logo_url: null,
};

const DEMO_ITEMS: MenuItem[] = [
  // Entradas
  { id: 'd1', restaurant_id: 'demo', name_pt: 'Pão com Manteiga', name_en: 'Bread & Butter', name_zh: '黄油面包', description_pt: 'Pão artesanal com manteiga da aldeia', description_en: 'Artisan bread with village butter', price: 2.50, category: 'Entradas', emoji: '🍞', available: true, sort_order: 1, created_at: '' },
  { id: 'd2', restaurant_id: 'demo', name_pt: 'Azeitonas Temperadas', name_en: 'Seasoned Olives', name_zh: '调味橄榄', description_pt: 'Azeitonas marinadas com alho e ervas', description_en: 'Marinated olives with garlic and herbs', price: 4.50, category: 'Entradas', emoji: '🫒', available: true, sort_order: 2, created_at: '' },
  { id: 'd3', restaurant_id: 'demo', name_pt: 'Caldo Verde', name_en: 'Green Broth Soup', name_zh: '绿汤', description_pt: 'Sopa tradicional com couve e chouriço', description_en: 'Traditional soup with kale and chorizo', price: 6.50, category: 'Entradas', emoji: '🥣', available: true, sort_order: 3, created_at: '' },
  { id: 'd4', restaurant_id: 'demo', name_pt: 'Pataniscas de Bacalhau', name_en: 'Codfish Fritters', name_zh: '鳕鱼饼', description_pt: 'Frituras de bacalhau com salada de feijão frade', description_en: 'Codfish fritters with black-eyed pea salad', price: 9.50, category: 'Entradas', emoji: '🐟', available: true, sort_order: 4, created_at: '' },
  // Pratos
  { id: 'd5', restaurant_id: 'demo', name_pt: 'Bacalhau à Brás', name_en: 'Codfish à Brás', name_zh: '碎蛋鳕鱼', description_pt: 'Bacalhau desfiado com batata palha e ovos mexidos', description_en: 'Shredded codfish with straw potatoes and scrambled eggs', price: 18.50, category: 'Pratos', emoji: '🥚', available: true, sort_order: 1, created_at: '' },
  { id: 'd6', restaurant_id: 'demo', name_pt: 'Frango no Churrasco', name_en: 'BBQ Chicken', name_zh: '烤鸡', description_pt: 'Frango grelhado com molho piri-piri', description_en: 'Grilled chicken with piri-piri sauce and fries', price: 15.00, category: 'Pratos', emoji: '🍗', available: true, sort_order: 2, created_at: '' },
  { id: 'd7', restaurant_id: 'demo', name_pt: 'Polvo à Lagareiro', name_en: 'Octopus Lagareiro', name_zh: '橄榄油章鱼', description_pt: 'Polvo assado com azeite e batata a murro', description_en: 'Roasted octopus with olive oil and crushed potatoes', price: 22.00, category: 'Pratos', emoji: '🐙', available: true, sort_order: 3, created_at: '' },
  { id: 'd8', restaurant_id: 'demo', name_pt: 'Bitoque de Vaca', name_en: 'Beef Steak', name_zh: '牛排套餐', description_pt: 'Bife de vaca com ovo estrelado e batata frita', description_en: 'Beef steak with fried egg and french fries', price: 16.50, category: 'Pratos', emoji: '🥩', available: true, sort_order: 4, created_at: '' },
  { id: 'd9', restaurant_id: 'demo', name_pt: 'Arroz de Pato', name_en: 'Duck Rice', name_zh: '鸭肉饭', description_pt: 'Arroz cremoso de pato com chouriço', description_en: 'Creamy duck rice with chorizo and orange', price: 17.50, category: 'Pratos', emoji: '🦆', available: true, sort_order: 5, created_at: '' },
  // Bebidas
  { id: 'd10', restaurant_id: 'demo', name_pt: 'Vinho Tinto da Casa', name_en: 'House Red Wine', name_zh: '招牌红酒', description_pt: 'Vinho tinto regional, copo', description_en: 'Regional red wine, by the glass', price: 4.00, category: 'Bebidas', emoji: '🍷', available: true, sort_order: 1, created_at: '' },
  { id: 'd11', restaurant_id: 'demo', name_pt: 'Super Bock', name_en: 'Super Bock Beer', name_zh: '超级波克啤酒', description_pt: 'Cerveja portuguesa gelada, 33cl', description_en: 'Cold Portuguese beer, 33cl', price: 2.50, category: 'Bebidas', emoji: '🍺', available: true, sort_order: 2, created_at: '' },
  { id: 'd12', restaurant_id: 'demo', name_pt: 'Água com Gás', name_en: 'Sparkling Water', name_zh: '气泡水', description_pt: 'Água mineral com gás, 50cl', description_en: 'Sparkling mineral water, 50cl', price: 1.50, category: 'Bebidas', emoji: '💧', available: true, sort_order: 3, created_at: '' },
  { id: 'd13', restaurant_id: 'demo', name_pt: 'Café Expresso', name_en: 'Espresso Coffee', name_zh: '浓缩咖啡', description_pt: 'Café expresso tradicional português', description_en: 'Traditional Portuguese espresso coffee', price: 1.00, category: 'Bebidas', emoji: '☕', available: true, sort_order: 4, created_at: '' },
  // Sobremesas
  { id: 'd14', restaurant_id: 'demo', name_pt: 'Pastel de Nata', name_en: 'Custard Tart', name_zh: '葡式蛋挞', description_pt: 'Pastel de Belém com canela e açúcar em pó', description_en: 'Custard tart with cinnamon and powdered sugar', price: 2.50, category: 'Sobremesas', emoji: '🥧', available: true, sort_order: 1, created_at: '' },
  { id: 'd15', restaurant_id: 'demo', name_pt: 'Arroz Doce', name_en: 'Rice Pudding', name_zh: '葡式米布丁', description_pt: 'Arroz doce cremoso com canela e limão', description_en: 'Creamy rice pudding with cinnamon and lemon', price: 5.00, category: 'Sobremesas', emoji: '🍮', available: true, sort_order: 2, created_at: '' },
];

export const metadata = {
  title: 'Casa Portuguesa — 菜单演示',
};

export default function DemoMenuPage() {
  return (
    <MenuPage
      restaurant={DEMO_RESTAURANT}
      menuItems={DEMO_ITEMS}
      tableNumber={5}
      isDemo
    />
  );
}
