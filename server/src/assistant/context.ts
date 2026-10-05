import type { getDb } from '../db';
import { eq } from 'drizzle-orm';
import { schema } from '../db';

type DB = ReturnType<typeof getDb>;

/**
 * Pull the published CMS content the assistant is allowed to ground answers on.
 * Keep the text compact — this is sent on every turn.
 */
export async function buildPublicContext(db: DB): Promise<string> {
  const [servicesList, faqs, plansList, featuredProjects, settingsRows] = await Promise.all([
    db.select().from(schema.services).where(eq(schema.services.isPublished, true)).orderBy(schema.services.order),
    db.select().from(schema.faqs).where(eq(schema.faqs.isPublished, true)).orderBy(schema.faqs.order),
    db.select().from(schema.pricingPlans).where(eq(schema.pricingPlans.isPublished, true)).orderBy(schema.pricingPlans.order),
    db.select().from(schema.projects).where(eq(schema.projects.isPublished, true)).limit(12),
    db.select().from(schema.siteSettings),
  ]);

  const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));

  const servicesText = servicesList.length
    ? servicesList.map(s => `- ${s.title}: ${s.shortDescription ?? ''}`).join('\n')
    : '(no published services yet)';

  const pricingText = plansList.length
    ? plansList.map(p => {
        const price = p.priceMonthly != null
          ? `$${p.priceMonthly}/mo`
          : p.priceOneTime != null ? `from $${p.priceOneTime}` : 'custom (contact for quote)';
        return `- ${p.name} (${price}): ${(p.features ?? []).slice(0, 4).join(', ')}`;
      }).join('\n')
    : '(no published pricing — all work is custom-quoted)';

  const faqText = faqs.length
    ? faqs.slice(0, 12).map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : '(no FAQs yet)';

  const projectsText = featuredProjects.length
    ? featuredProjects.map(p => {
        const clientLine = p.hasClientPermission && p.clientName ? ` for ${p.clientName}` : '';
        return `- ${p.title}${clientLine} (${p.platform ?? ''}${p.framework ? `, ${p.framework}` : ''}): ${p.challenge ?? p.objective ?? ''}`.trim();
      }).join('\n')
    : '(no public portfolio entries yet)';

  const availability = (settings.availability as { value?: string })?.value ?? 'AVAILABLE';

  return `AVAILABILITY: ${availability}

SERVICES:
${servicesText}

PRICING:
${pricingText}

FEATURED WORK (only with explicit client permission):
${projectsText}

FAQ:
${faqText}
`;
}
