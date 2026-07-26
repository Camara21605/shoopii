# Guide — Ajouter un nouveau module

Ce guide suit le pattern établi sur Shopi. Adapter les noms au domaine.

---

## 1. Créer la structure de fichiers

```
src/modules/mon-module/
├── mon-module.module.ts
├── mon-module.controller.ts
├── mon-module.service.ts
├── dto/
│   ├── create-mon-entite.dto.ts
│   └── update-mon-entite.dto.ts
└── mon-module.engine.ts   (si logique métier complexe)
```

---

## 2. En-tête obligatoire sur chaque fichier

```typescript
/* ============================================================
 * FICHIER : src/modules/mon-module/mon-module.service.ts
 * MODULE : MonModule
 * ROLE : Description courte du rôle
 * RESPONSABILITES :
 *   - Responsabilité 1
 *   - Responsabilité 2
 * DEPENDANCES :
 *   - Repository<MonEntite>
 *   - AutreService
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */
```

---

## 3. Déclarer le module NestJS

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([MonEntite]),
    // Autres modules dont vous dépendez
  ],
  controllers: [MonModuleController],
  providers: [MonModuleService],
  exports: [MonModuleService],  // Si utilisé par d'autres modules
})
export class MonModule {}
```

---

## 4. Enregistrer dans app.module.ts

```typescript
// Dans la section appropriée de app.module.ts
import { MonModule } from './modules/mon-module/mon-module.module';

@Module({
  imports: [
    // ...modules existants...
    MonModule,  // Ajouter ici
  ],
})
```

> **Attention** : Si votre module dépend de Redis ou BullMQ, le déclarer **après** `RedisModule` et `BullModule`.

---

## 5. Créer l'entité TypeORM

```typescript
/* ============================================================
 * FICHIER : src/database/entities/mon-module/mon-entite.entity.ts
 * ============================================================ */

@Entity('mon_entite')
export class MonEntite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nom: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;  // Soft delete
}
```

---

## 6. Créer la migration

```bash
cd shopi-backend
npm run migration:generate -- --name=MonModule
```

Vérifier le fichier généré dans `src/database/migrations/`. Exécuter :

```bash
npm run migration:run
```

---

## 7. Sécuriser les endpoints

```typescript
@Controller('mon-module')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MonModuleController {

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() { ... }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  findOne(@Param('id') id: string) { ... }
}
```

---

## 8. Valider les DTOs

```typescript
export class CreateMonEntiteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nom: string;

  @IsEnum(MonEnum)  // Jamais @IsString() pour les enums
  statut: MonEnum;
}
```

---

## 9. Gérer les erreurs sans exposer la stack trace

```typescript
// Créer src/common/exceptions/mon-module.exceptions.ts
export class MonModuleException extends HttpException {
  constructor(message: string, status = HttpStatus.BAD_REQUEST) {
    super({ message }, status);  // Pas de stack trace
  }
}
```

---

## 10. Écrire les tests

```bash
# Créer src/modules/mon-module/mon-module.service.spec.ts
# Suivre le pattern des tests existants (voir guides/testing.md)
```

Vérifier que la couverture reste au-dessus des seuils :

```bash
npx jest --selectProjects unit --coverage
```

---

## Checklist finale

- [ ] En-tête sur chaque fichier
- [ ] Module déclaré dans `app.module.ts`
- [ ] Entité avec soft delete (`@DeleteDateColumn`)
- [ ] Migration créée et exécutée
- [ ] Endpoints protégés par `JwtAuthGuard` + `RolesGuard`
- [ ] DTOs avec validation class-validator (`@IsEnum` pour les enums)
- [ ] Erreurs sans stack trace
- [ ] Tests écrits (couverture ≥ 70%)
- [ ] OWASP Top 10 vérifié (pas de SQL injection possible, CORS correct…)
