* Voeg `.jsonld` file toe aan `import` van de `component.json`
* requireElement invullen, zie bericht op Mattermost
* TODO alternative string notations: https://stackoverflow.com/a/14727461/4367621
* Constructorarguments:
    ```
    for arg in constr:
        vind klasse van argument mbhv helper methodes
        if is component:
            if name and type match with parsed parameter x:
                voeg {"@id":"bestaande parameter x"} toe
            else:
                voeg {"@id":"nieuwe constructor arg x"} toe
                // TODO extra velden ook nodig?
        else:
            // TODO what do we want to do if a another class uses the same constructor argument with an 
            // existing id?
  
            // We have to deal with a class that potentially extends another class
            // We have to deal with a class that potentially has some own fields
            for field in object:
                if name and type match with parameter x:
                    voeg {"value":"bestaande parameter x"} nested toe
                else:
                    // TODO welke value?
                    voeg {"value":"???"} nested toe
                voeg keyRaw toe als naam van veld
  
            if has extending class:
                zoek declaratie van class
                
                zoek @id van extending class in 'chain of extends'  
   ```
