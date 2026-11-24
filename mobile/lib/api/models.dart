// Data models for the /api/v1 contract. Parsing is deliberately lenient
// (missing fields get defaults) so small backend differences don't crash
// the app. See API_ASSUMPTIONS.md.

int _int(dynamic v, [int d = 0]) =>
    v is int ? v : (v is num ? v.round() : int.tryParse('${v ?? ''}') ?? d);
String _str(dynamic v, [String d = '']) => v == null ? d : '$v';
bool _bool(dynamic v, [bool d = false]) =>
    v is bool ? v : (v is num ? v != 0 : (v == null ? d : '$v' == 'true'));

class Queue {
  final int id;
  final String name;
  final bool open;
  final int current; // number currently being served (0 = none)
  final int waiting;
  final int estMinutes;
  final int serviceMinutes;

  Queue({
    required this.id,
    required this.name,
    this.open = true,
    this.current = 0,
    this.waiting = 0,
    this.estMinutes = 0,
    this.serviceMinutes = 3,
  });

  factory Queue.fromJson(Map<String, dynamic> j) => Queue(
        id: _int(j['id']),
        name: _str(j['name']),
        open: _bool(j['open'] ?? j['is_open'], true),
        current: _int(j['current_number'] ?? j['current']),
        waiting: _int(j['waiting'] ?? j['waiting_count']),
        estMinutes: _int(j['est_wait_minutes'] ?? j['est_wait_min']),
        serviceMinutes: _int(j['avg_minutes'] ?? j['service_min'], 3),
      );
}

class Store {
  final String code;
  final String name;
  final String area;
  final bool preorders;
  final List<Queue> queues;

  Store({
    required this.code,
    required this.name,
    this.area = '',
    this.preorders = false,
    this.queues = const [],
  });

  factory Store.fromJson(Map<String, dynamic> j) {
    final s = (j['store'] is Map) ? Map<String, dynamic>.from(j['store']) : j;
    final qs = (j['queues'] ?? s['queues']) as List? ?? const [];
    return Store(
      code: _str(s['code']),
      name: _str(s['name']),
      area: _str(s['area']),
      preorders: _bool(s['orders_enabled'] ?? s['preorders']),
      queues: qs
          .map((e) => Queue.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class Ticket {
  final String token;
  final int number;
  final String status; // waiting|called|done|skipped|cancelled
  final int current;
  final int ahead;
  final int estMinutes;
  final String queueName;
  final String storeName;
  final String storeCode;

  Ticket({
    required this.token,
    required this.number,
    required this.status,
    this.current = 0,
    this.ahead = 0,
    this.estMinutes = 0,
    this.queueName = '',
    this.storeName = '',
    this.storeCode = '',
  });

  bool get active => status == 'waiting' || status == 'called';

  factory Ticket.fromJson(Map<String, dynamic> j) {
    final t = (j['ticket'] is Map) ? Map<String, dynamic>.from(j['ticket']) : j;
    final q = t['queue'] is Map ? Map<String, dynamic>.from(t['queue']) : {};
    final s = t['store'] is Map ? Map<String, dynamic>.from(t['store']) : {};
    return Ticket(
      token: _str(t['token']),
      number: _int(t['number']),
      status: _str(t['status'], 'waiting'),
      current: _int(t['current_number'] ?? q['current_number']),
      ahead: _int(t['ahead'] ?? t['people_ahead']),
      estMinutes: _int(t['est_wait_minutes'] ?? t['est_wait_min']),
      queueName: _str(t['queue_name'] ?? q['name']),
      storeName: _str(t['store_name'] ?? s['name']),
      storeCode: _str(t['store_code'] ?? s['code']),
    );
  }

  Map<String, dynamic> toJson() => {
        'token': token,
        'number': number,
        'status': status,
        'current_number': current,
        'ahead': ahead,
        'est_wait_minutes': estMinutes,
        'queue_name': queueName,
        'store_name': storeName,
        'store_code': storeCode,
      };
}

class MenuItem {
  final int id;
  final String name;
  final String price; // API sends price as free text, e.g. "5"
  final bool available;
  MenuItem(
      {required this.id,
      required this.name,
      this.price = '',
      this.available = true});
  factory MenuItem.fromJson(Map<String, dynamic> j) => MenuItem(
        id: _int(j['id']),
        name: _str(j['name']),
        price: _str(j['price']),
        available: _bool(j['available'], true),
      );
}

class OrderLine {
  final String name;
  final int qty;
  OrderLine(this.name, this.qty);
  factory OrderLine.fromJson(Map<String, dynamic> j) =>
      OrderLine(_str(j['name']), _int(j['qty'] ?? j['quantity'], 1));
}

class Order {
  final int id;
  final String token;
  final int number;
  final String status; // new|preparing|ready|picked|cancelled
  final String name;
  final String phone;
  final String note;
  final String pickup;
  final List<OrderLine> items;

  Order({
    this.id = 0,
    this.token = '',
    required this.number,
    required this.status,
    this.name = '',
    this.phone = '',
    this.note = '',
    this.pickup = '',
    this.items = const [],
  });

  bool get active => ['new', 'preparing', 'ready'].contains(status);

  factory Order.fromJson(Map<String, dynamic> j) {
    final o = (j['order'] is Map) ? Map<String, dynamic>.from(j['order']) : j;
    return Order(
      id: _int(o['id']),
      token: _str(o['token']),
      number: _int(o['number']),
      status: _str(o['status'], 'new'),
      name: _str(o['name']),
      phone: _str(o['phone']),
      note: _str(o['note']),
      pickup: _str(o['pickup']),
      items: ((o['items'] as List?) ?? const [])
          .map((e) => OrderLine.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}
