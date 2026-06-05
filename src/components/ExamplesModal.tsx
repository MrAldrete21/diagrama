type Example = {
  id: string;
  name: string;
  description: string;
  source: string;
};

const EXAMPLES: Example[] = [
  {
    id: 'simple-flow',
    name: 'Flujo Simple',
    description: 'Flowchart basico con grupo y shapes mixtos',
    source: `direction TB
title: Flujo Simple

User [shape: circle] > App
App > DB [shape: cylinder]
App > API
`,
  },
  {
    id: 'cloud-arch',
    name: 'Cloud Architecture',
    description: 'Arquitectura AWS con iconos',
    source: `direction LR
title: AWS Architecture

CDN [icon: aws-cloudfront]
LB [icon: aws-elb]
EC2A [icon: aws-ec2, label: Web 1]
EC2B [icon: aws-ec2, label: Web 2]
RDS [icon: aws-rds, shape: cylinder]
Cache [icon: aws-elasticache, shape: cylinder]

CDN > LB
LB > EC2A
LB > EC2B
EC2A, EC2B > RDS
EC2A, EC2B > Cache
`,
  },
  {
    id: 'sequence',
    name: 'Secuencia OAuth',
    description: 'Diagrama de secuencia: login OAuth',
    source: `type: sequence
title: OAuth Login

User > Frontend: click login
Frontend > AuthService: redirect
AuthService > User: prompt password
User > AuthService: credentials
AuthService > Frontend: token
note over Frontend, AuthService: token guardado en cookie
Frontend > API: request + token
API --> Frontend: data
`,
  },
  {
    id: 'er',
    name: 'ER: Blog',
    description: 'Esquema relacional de un blog',
    source: `type: er
title: Blog DB
direction LR

User {
  id uuid pk
  email string
  name string
  created_at timestamp
}

Post {
  id uuid pk
  author_id uuid fk
  title string
  body text
  published_at timestamp
}

Comment {
  id uuid pk
  post_id uuid fk
  author_id uuid fk
  body text
  created_at timestamp
}

Tag {
  id uuid pk
  name string
}

PostTag {
  post_id uuid pk fk
  tag_id uuid pk fk
}

User.id > Post.author_id
User.id > Comment.author_id
Post.id > Comment.post_id
Post.id > PostTag.post_id
Tag.id > PostTag.tag_id
`,
  },
  {
    id: 'decision',
    name: 'Arbol de Decision',
    description: 'Multiples ramas con etiquetas si/no',
    source: `direction TB
title: Despliegue

Start [shape: circle, label: inicio]
Tests [shape: diamond, label: tests pasan?]
Build
Lint [shape: diamond, label: lint ok?]
Deploy
Fail [shape: hexagon, color: #fee2e2]
End [shape: circle, label: fin]

Start > Tests
Tests > Build: si
Tests > Fail: no
Build > Lint
Lint > Deploy: si
Lint > Fail: no
Deploy > End
Fail > End [style: dashed]
`,
  },
  {
    id: 'state',
    name: 'Maquina de estados',
    description: 'Estados con transiciones bidireccionales',
    source: `direction LR
title: Pedido

Pending [shape: circle] > Processing
Processing > Shipped
Shipped > Delivered
Processing <> Cancelled [style: dashed]
Pending <> Cancelled [style: dashed]
`,
  },
];

export function ExamplesModal({
  onSelect,
  onClose,
}: {
  onSelect: (source: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Ejemplos</h2>
          <button
            type="button"
            className="btn btn-ghost modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            x
          </button>
        </header>
        <div className="modal-body examples-grid">
          {EXAMPLES.map((ex) => (
            <button
              type="button"
              className="example-card"
              key={ex.id}
              onClick={() => {
                onSelect(ex.source);
                onClose();
              }}
            >
              <div className="example-title">{ex.name}</div>
              <div className="example-desc">{ex.description}</div>
              <pre className="example-preview">{ex.source.slice(0, 180)}</pre>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
