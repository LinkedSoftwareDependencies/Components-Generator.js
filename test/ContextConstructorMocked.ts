/* istanbul ignore file */
import { ComponentDefinitions } from '../lib/serialize/ComponentDefinitions';
import { ContextConstructor, ContextRaw } from '../lib/serialize/ContextConstructor';

export class ContextConstructorMocked extends ContextConstructor {
  public constructContext(components?: ComponentDefinitions): ContextRaw {
    const contextRaw = super.constructContext(components);
    // Remove LSD URL, to avoid having the context parser dereference it, which slows down tests
    contextRaw['@context'].splice(0, 1);
    return contextRaw;
  }
}
