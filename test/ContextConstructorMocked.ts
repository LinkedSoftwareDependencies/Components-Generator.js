/* istanbul ignore file */
import type { ComponentDefinitions } from '../lib/serialize/ComponentDefinitions';
import type { ContextRaw } from '../lib/serialize/ContextConstructor';
import { ContextConstructor } from '../lib/serialize/ContextConstructor';

export class ContextConstructorMocked extends ContextConstructor {
  public constructContext(components?: ComponentDefinitions): ContextRaw {
    const contextRaw = super.constructContext(components);
    // Remove LSD URL, to avoid having the context parser dereference it, which slows down tests
    contextRaw['@context'].splice(0, 1);
    return contextRaw;
  }
}
